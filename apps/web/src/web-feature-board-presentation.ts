export function featureRequestSubmitPresentation(pending: boolean): {
  busy: boolean;
  disabled: boolean;
  label: string;
} {
  return {
    busy: pending,
    disabled: pending,
    label: pending ? "Submitting request…" : "Submit request",
  };
}
