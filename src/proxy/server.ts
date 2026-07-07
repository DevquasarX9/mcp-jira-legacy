import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { Agent, request, type Dispatcher } from "undici";
import { Logger } from "../utils/logger.js";
import { evaluateRouteAccess } from "./route-policy.js";
import { validateLocalProxyToken } from "./auth.js";
import type { ProxyConfig } from "./config.js";
import { isProxyError, ProxyError } from "./errors.js";
import { buildUpstreamHeaders } from "./headers.js";
import { isLoopbackAddress, normalizeAndValidateRequestTarget } from "./security.js";
import { forwardUpstream, type UpstreamRequestFn } from "./upstream.js";

const MULTIPART_FORM_DATA_CONTENT_TYPE = /^multipart\/form-data(?:;.*)?$/i;

export interface CreateProxyServerOptions {
  readonly dispatcher?: Dispatcher;
  readonly logger?: Logger;
  readonly requestImpl?: UpstreamRequestFn;
}

export function createProxyServer(
  config: ProxyConfig,
  options: CreateProxyServerOptions = {},
): FastifyInstance {
  const logger = options.logger ?? new Logger(config.logLevel);
  const dispatcher = options.dispatcher ?? buildDispatcher(config);
  const requestImpl = options.requestImpl ?? (request as UpstreamRequestFn);

  const app = Fastify({
    bodyLimit: config.maxRequestBytes,
    logger: false,
  });

  app.addContentTypeParser(
    MULTIPART_FORM_DATA_CONTENT_TYPE,
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.setErrorHandler((error, requestContext, reply) => {
    const proxyError = isProxyError(error)
      ? error
      : new ProxyError(500, "INTERNAL_ERROR", "internal proxy error", false);

    logger.error("proxy_request_failed", {
      method: requestContext.method,
      path: requestContext.raw.url ?? requestContext.url,
      statusCode: proxyError.statusCode,
      code: proxyError.code,
      message: proxyError.expose ? proxyError.message : "internal error",
    });

    void reply.code(proxyError.statusCode).send({
      error: proxyError.code,
      message: proxyError.expose ? proxyError.message : "internal proxy error",
    });
  });

  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    url: "/*",
    handler: async (requestContext, reply) => {
      await handleProxyRequest({
        config,
        dispatcher,
        logger,
        requestImpl,
        request: requestContext,
        reply,
      });
    },
  });

  return app;
}

export async function startProxyServer(
  app: FastifyInstance,
  config: ProxyConfig,
  logger: Logger = new Logger(config.logLevel),
): Promise<void> {
  if (
    config.allowNonLocalBind &&
    !["127.0.0.1", "::1", "localhost"].includes(config.proxyHost)
  ) {
    logger.warn("proxy_non_local_bind_enabled", {
      proxyHost: config.proxyHost,
      warning: "this exposes the proxy beyond the local machine",
    });
  }

  await app.listen({
    host: config.proxyHost,
    port: config.proxyPort,
  });

  logger.info("jira_auth_proxy_started", {
    proxyHost: config.proxyHost,
    proxyPort: config.proxyPort,
    writeEnabled: config.proxyEnableWrite,
    localProxyTokenRequired: config.localProxyToken !== undefined,
  });
}

async function handleProxyRequest({
  config,
  dispatcher,
  logger,
  requestImpl,
  request,
  reply,
}: {
  readonly config: ProxyConfig;
  readonly dispatcher: Dispatcher;
  readonly logger: Logger;
  readonly requestImpl: UpstreamRequestFn;
  readonly request: FastifyRequest;
  readonly reply: FastifyReply;
}): Promise<void> {
  const startedAt = process.hrtime.bigint();
  const clientAddress = request.ip;

  if (config.localProxyToken === undefined && !isLoopbackAddress(clientAddress)) {
    throw new ProxyError(403, "LOCALHOST_REQUIRED", "proxy only accepts localhost callers");
  }

  validateLocalProxyToken(request.headers, config.localProxyToken);

  const rawUrl = request.raw.url ?? request.url;
  const { normalizedPath, queryString } = normalizeAndValidateRequestTarget(rawUrl);
  const decision = evaluateRouteAccess(config, request.method, normalizedPath);

  if (!decision.allowed) {
    throw new ProxyError(
      403,
      decision.reason === "read_only" ? "READ_ONLY_MODE" : "ROUTE_NOT_ALLOWED",
      decision.reason === "read_only"
        ? "write route rejected because JIRA_PROXY_ENABLE_WRITE=false"
        : "route not allowed by proxy policy",
    );
  }

  const upstreamBody = serializeBody(request.body);
  const upstreamResponse = await forwardUpstream({
    config,
    dispatcher,
    requestImpl,
    method: request.method,
    normalizedPath,
    queryString,
    headers: buildUpstreamHeaders(config, request.headers),
    ...(upstreamBody === undefined ? {} : { body: upstreamBody }),
  });

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  logger.info("proxy_request_completed", {
    method: request.method,
    path: normalizedPath,
    statusCode: upstreamResponse.statusCode,
    durationMs: Number(durationMs.toFixed(2)),
    access: decision.access,
    allowed: true,
    upstreamStatus: upstreamResponse.statusCode,
    tokenProtected: config.localProxyToken !== undefined,
    clientAddress,
  });

  reply.headers(upstreamResponse.headers);
  void reply.code(upstreamResponse.statusCode).send(upstreamResponse.body);
}

function serializeBody(body: unknown): string | Buffer | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (Buffer.isBuffer(body) || typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

function buildDispatcher(config: ProxyConfig): Dispatcher {
  return new Agent({
    connect: {
      rejectUnauthorized: config.strictSsl,
      ...(config.caCert === undefined ? {} : { ca: config.caCert }),
    },
  });
}
