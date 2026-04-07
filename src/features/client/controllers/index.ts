import type { ApiVersion } from "../../../types";
import type { ClientMethods } from "./types";
import { baseV100Controller } from "./base.v1_0_0_0.controller";
import { controllerV101 } from "./override.v1_0_0_1.controller";

const controllerByApiVersion: Record<ApiVersion, ClientMethods> = {
  "1.0.0.0": baseV100Controller,
  "1.0.0.1": controllerV101
};

export function resolveClientController(apiVersion: string): ClientMethods {
  if (apiVersion === "1.0.0.1") return controllerByApiVersion["1.0.0.1"];
  return controllerByApiVersion["1.0.0.0"];
}
