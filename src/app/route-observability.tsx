import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import {
  addObservabilityBreadcrumb,
  setObservabilityRoute,
  sanitizeMonitoringUrl,
} from "../lib/observability";

export function RouteObservability() {
  const location = useLocation();

  useEffect(() => {
    const route = sanitizeMonitoringUrl(location.pathname);

    setObservabilityRoute(route);
    addObservabilityBreadcrumb({
      category: "navigation",
      message: "Route viewed",
      data: {
        route,
      },
    });
  }, [location.pathname]);

  return null;
}
