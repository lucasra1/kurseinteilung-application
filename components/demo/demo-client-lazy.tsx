"use client";

import dynamic from "next/dynamic";

/** Loaded only when rendered, so normal deployments never download the demo code. */
export const DemoClientLazy = dynamic(() =>
  import("./demo-client").then((m) => m.DemoClient),
);
