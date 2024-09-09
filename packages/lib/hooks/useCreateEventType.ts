import { zodResolver } from "@hookform/resolvers/zod";
import type { EventType } from "@prisma/client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { SchedulingType } from "@calcom/prisma/enums";
import { unlockedManagedEventTypeProps } from "@calcom/prisma/zod-utils";
import { createEventTypeInput } from "@calcom/prisma/zod/custom/eventtype";
import { trpc } from "@calcom/trpc/react";

export const useCreateEventType = (
  onSuccessMutation: (eventType: EventType) => void,
  onErrorMutation: (message: string) => void,
  isInfiniteScrollEnabled: boolean
) => {
  const utils = trpc.useUtils();
  const { t } = useLocale();
  const form = useForm<z.infer<typeof createEventTypeInput>>({
    defaultValues: {
      length: 15,
    },
    resolver: zodResolver(createEventTypeInput),
  });

  const schedulingTypeWatch = form.watch("schedulingType");
  const isManagedEventType = schedulingTypeWatch === SchedulingType.MANAGED;

  useEffect(() => {
    if (isManagedEventType) {
      form.setValue("metadata.managedEventConfig.unlockedFields", unlockedManagedEventTypeProps);
    } else {
      form.setValue("metadata", null);
    }
  }, [schedulingTypeWatch]);

  const createMutation = trpc.viewer.eventTypes.create.useMutation({
    onSuccess: async ({ eventType }) => {
      onSuccessMutation(eventType);

      if (isInfiniteScrollEnabled) {
        await utils.viewer.eventTypes.getEventTypesFromGroup.fetchInfinite({
          group: { teamId: eventType.teamId, parentId: eventType.parentId },
          limit: 10,
        });
      } else {
        await utils.viewer.eventTypes.getByViewer.invalidate();
      }

      form.reset();
    },
    onError: (err) => {
      let error = err.message;
      if (err instanceof HttpError) {
        error = `${err.statusCode}: ${err.message}`;
      }

      if (err.data?.code === "BAD_REQUEST") {
        error = `${err.data.code}: ${t("error_event_type_url_duplicate")}`;
      }

      if (err.data?.code === "UNAUTHORIZED") {
        error = `${err.data.code}: ${t("error_event_type_unauthorized_create")}`;
      }
      onErrorMutation(error);
    },
  });

  return { form, createMutation, isManagedEventType };
};