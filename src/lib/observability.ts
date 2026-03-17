import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const maxStringLength = 160;
const maxCollectionLength = 10;
const maxSanitizeDepth = 4;
const noisyBreadcrumbCategories = new Set(["fetch", "ui.click", "xhr"]);
const sensitiveKeyPattern =
  /(authorization|cookie|lyrics|note|otp|password|payload|secret|sheet|token)/i;

let hasInitializedSentry = false;

type BreadcrumbLevel =
  | "debug"
  | "error"
  | "fatal"
  | "info"
  | "log"
  | "warning";

export interface ObservabilityBreadcrumb {
  category: string;
  message: string;
  data?: Record<string, unknown>;
  level?: BreadcrumbLevel;
}

interface CaptureObservabilityErrorOptions {
  operation: string;
  route?: string;
  context?: Record<string, unknown>;
}

interface CaptureObservabilityMessageOptions
  extends CaptureObservabilityErrorOptions {
  level?: BreadcrumbLevel;
}

interface ObservabilityTimeoutOptions extends CaptureObservabilityMessageOptions {
  message?: string;
  timeoutMs?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function shouldRedactKey(key?: string): boolean {
  return Boolean(key && sensitiveKeyPattern.test(key));
}

function sanitizeString(value: string): string {
  return value.length > maxStringLength
    ? `${value.slice(0, maxStringLength)}...`
    : value;
}

function sanitizeValue(
  value: unknown,
  key?: string,
  depth = 0,
): unknown {
  if (shouldRedactKey(key)) {
    return `[redacted:${key}]`;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "string") {
    if (key === "url" || key === "route" || key === "pathname") {
      return sanitizeMonitoringUrl(value);
    }

    return sanitizeString(value);
  }

  if (depth >= maxSanitizeDepth) {
    return "[truncated]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, maxCollectionLength)
      .map((entry) => sanitizeValue(entry, key, depth + 1));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, maxCollectionLength)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeValue(entryValue, entryKey, depth + 1),
        ]),
    );
  }

  return Object.prototype.toString.call(value);
}

function sanitizeEvent<TEvent extends Sentry.Event>(
  event: TEvent,
): TEvent {
  const sanitizedEvent: Sentry.Event = {
    ...event,
    breadcrumbs: event.breadcrumbs
      ?.map((breadcrumb) => {
        if (
          breadcrumb.category &&
          noisyBreadcrumbCategories.has(breadcrumb.category)
        ) {
          return null;
        }

        return {
          ...breadcrumb,
          message: breadcrumb.message
            ? sanitizeString(breadcrumb.message)
            : breadcrumb.message,
          data: breadcrumb.data
            ? (sanitizeValue(breadcrumb.data) as typeof breadcrumb.data)
            : breadcrumb.data,
        };
      })
      .filter((breadcrumb): breadcrumb is NonNullable<typeof breadcrumb> =>
        Boolean(breadcrumb),
      ),
    contexts: event.contexts
      ? (sanitizeValue(event.contexts) as typeof event.contexts)
      : event.contexts,
    extra: event.extra
      ? (sanitizeValue(event.extra) as typeof event.extra)
      : event.extra,
    request: event.request
      ? {
          ...event.request,
          cookies: undefined,
          data: event.request.data
            ? sanitizeValue(event.request.data, "payload")
            : event.request.data,
          headers: event.request.headers
            ? (sanitizeValue(event.request.headers) as typeof event.request.headers)
            : event.request.headers,
          url: event.request.url
            ? sanitizeMonitoringUrl(event.request.url)
            : event.request.url,
        }
      : event.request,
    user: event.user?.id ? { id: event.user.id } : undefined,
  };

  return sanitizedEvent as TEvent;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown application error.");
}

export function sanitizeMonitoringUrl(url: string): string {
  if (!url) {
    return "/";
  }

  try {
    if (url.startsWith("/")) {
      return new URL(url, "https://cuelist.local").pathname;
    }

    const parsedUrl = new URL(url);
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  } catch {
    return url.split(/[?#]/u, 1)[0] || "/";
  }
}

export function sanitizeMonitoringEvent<T extends { url: string }>(event: T): T {
  return {
    ...event,
    url: sanitizeMonitoringUrl(event.url),
  };
}

export function isSentryEnabled(): boolean {
  return Boolean(sentryDsn);
}

export function initializeSentry(): void {
  if (hasInitializedSentry || !sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    environment: import.meta.env.PROD ? "production" : "development",
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (
        breadcrumb.category &&
        noisyBreadcrumbCategories.has(breadcrumb.category)
      ) {
        return null;
      }

      return {
        ...breadcrumb,
        message: breadcrumb.message
          ? sanitizeString(breadcrumb.message)
          : breadcrumb.message,
        data: breadcrumb.data
          ? (sanitizeValue(breadcrumb.data) as typeof breadcrumb.data)
          : breadcrumb.data,
      };
    },
    beforeSend(event) {
      return sanitizeEvent(event);
    },
  });

  hasInitializedSentry = true;
}

export function addObservabilityBreadcrumb({
  category,
  data,
  level = "info",
  message,
}: ObservabilityBreadcrumb): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.addBreadcrumb({
    category,
    data: data ? (sanitizeValue(data) as Record<string, unknown>) : undefined,
    level,
    message,
    timestamp: Date.now() / 1000,
  });
}

export function captureObservabilityError(
  error: unknown,
  { context, operation, route }: CaptureObservabilityErrorOptions,
): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("operation", operation);

    if (route) {
      scope.setTag("route", sanitizeMonitoringUrl(route));
    }

    if (context) {
      scope.setContext(
        "cuelist",
        sanitizeValue(context) as Record<string, unknown>,
      );
    }

    scope.captureException(normalizeError(error));
  });
}

export function captureObservabilityMessage(
  message: string,
  {
    context,
    level = "warning",
    operation,
    route,
  }: CaptureObservabilityMessageOptions,
): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag("operation", operation);

    if (route) {
      scope.setTag("route", sanitizeMonitoringUrl(route));
    }

    if (context) {
      scope.setContext(
        "cuelist",
        sanitizeValue(context) as Record<string, unknown>,
      );
    }

    scope.captureMessage(message);
  });
}

export function startObservabilityTimeout({
  context,
  level = "warning",
  message = "Operation exceeded expected duration.",
  operation,
  route,
  timeoutMs = 10000,
}: ObservabilityTimeoutOptions): () => void {
  if (typeof window === "undefined" || timeoutMs <= 0) {
    return () => {};
  }

  let isCleared = false;
  const startedAt = Date.now();
  const timeoutId = window.setTimeout(() => {
    if (isCleared) {
      return;
    }

    const durationMs = Date.now() - startedAt;
    const timeoutContext = {
      ...context,
      durationMs,
      status: "timeout",
    };

    addObservabilityBreadcrumb({
      category: "timeout",
      level,
      message: "Operation exceeded expected duration",
      data: {
        operation,
        route,
        ...timeoutContext,
      },
    });
    captureObservabilityMessage(message, {
      context: timeoutContext,
      level,
      operation,
      route,
    });
  }, timeoutMs);

  return () => {
    if (isCleared) {
      return;
    }

    isCleared = true;
    window.clearTimeout(timeoutId);
  };
}

export function setObservabilityRoute(route: string): void {
  const sanitizedRoute = sanitizeMonitoringUrl(route);

  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setTag("route", sanitizedRoute);
  Sentry.setContext("screen", { route: sanitizedRoute });
}

export function setObservabilityUser(userId: string | null): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setUser(userId ? { id: userId } : null);
}
