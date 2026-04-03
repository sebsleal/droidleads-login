import { useCallback } from "react";
import { useToast } from "@/components/Toast";

export function useReadOnlyNotice() {
  const { addToast } = useToast();

  return useCallback(
    (message: string, title = "Read-only mode") => {
      addToast({
        type: "info",
        title,
        message,
      });
    },
    [addToast],
  );
}
