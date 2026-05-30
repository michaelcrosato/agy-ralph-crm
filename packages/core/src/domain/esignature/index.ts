import type {
  ESignatureTransitionInput,
  ESignatureTransitionResult,
} from "../../types";

export function processESignatureTransition(
  input: ESignatureTransitionInput,
): ESignatureTransitionResult {
  const { currentStatus, action } = input;

  if (currentStatus === "signed" || currentStatus === "declined") {
    throw new Error(`Cannot transition from completed state: ${currentStatus}`);
  }

  if (action === "decline") {
    return { nextStatus: "declined", isCompleted: true };
  }

  if (currentStatus === "sent" && action === "view") {
    return { nextStatus: "viewed", isCompleted: false };
  }

  if (currentStatus === "viewed" && action === "sign") {
    return { nextStatus: "signed", isCompleted: true };
  }

  throw new Error(`Invalid action '${action}' for status '${currentStatus}'`);
}
