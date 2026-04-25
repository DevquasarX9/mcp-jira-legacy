export interface JiraPaginatedResponse<T> {
  readonly startAt?: number;
  readonly maxResults?: number;
  readonly total?: number;
  readonly isLast?: boolean;
  readonly issues?: T[];
  readonly values?: T[];
}

export interface JiraServerInfo {
  readonly baseUrl?: string;
  readonly version?: string;
  readonly versionNumbers?: number[];
  readonly deploymentType?: string;
  readonly buildNumber?: number;
  readonly buildDate?: string;
  readonly serverTime?: string;
  readonly scmInfo?: string;
  readonly serverTitle?: string;
}

export interface JiraUser {
  readonly self?: string;
  readonly key?: string;
  readonly name?: string;
  readonly displayName?: string;
  readonly emailAddress?: string;
  readonly active?: boolean;
  readonly timeZone?: string;
}

export interface JiraProject {
  readonly self?: string;
  readonly id?: string;
  readonly key?: string;
  readonly name?: string;
  readonly projectTypeKey?: string;
  readonly simplified?: boolean;
}

export interface JiraIssue {
  readonly id?: string;
  readonly key?: string;
  readonly self?: string;
  readonly fields?: Record<string, unknown>;
  readonly changelog?: {
    readonly histories?: JiraChangelogHistory[];
  };
}

export interface JiraChangelogHistory {
  readonly id?: string;
  readonly author?: JiraUser;
  readonly created?: string;
  readonly items?: JiraChangelogItem[];
}

export interface JiraChangelogItem {
  readonly field?: string;
  readonly fieldtype?: string;
  readonly from?: string | null;
  readonly fromString?: string | null;
  readonly to?: string | null;
  readonly toString?: string | null;
}

export interface JiraComment {
  readonly id?: string;
  readonly body?: string;
  readonly author?: JiraUser;
  readonly updateAuthor?: JiraUser;
  readonly created?: string;
  readonly updated?: string;
}

export interface JiraTransition {
  readonly id?: string;
  readonly name?: string;
  readonly to?: {
    readonly id?: string;
    readonly name?: string;
    readonly statusCategory?: {
      readonly key?: string;
      readonly name?: string;
    };
  };
}

export interface JiraWorklog {
  readonly id?: string;
  readonly author?: JiraUser;
  readonly comment?: string;
  readonly started?: string;
  readonly timeSpent?: string;
  readonly timeSpentSeconds?: number;
}
