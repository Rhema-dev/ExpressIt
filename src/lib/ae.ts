import type {
  AEProperty,
  HostFailure,
  SelectedPropertyResult,
  ExpressItExpression,
} from '../types/types';
export const isCEP = () => typeof window !== 'undefined' && !!window.__adobe_cep__;
let inFlight = false;
export const hostBusy = () => inFlight;
async function callHost<T>(
  method: 'getSelectedProperty' | 'injectExpression' | 'captureSelectedExpression',
  args: (string | number | boolean)[] = [],
): Promise<T> {
  if (!isCEP()) throw new Error('Open ExpressIt in After Effects to use this action.');
  if (inFlight) throw new Error('After Effects is busy. Try again in a moment.');
  inFlight = true;
  return new Promise<T>((resolve, reject) => {
    // Timeout cannot cancel ExtendScript: retain the lock until its callback arrives.
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            'After Effects has not responded. Close host dialogs; if it remains busy, reopen the panel.',
          ),
        ),
      12000,
    );
    try {
      new CSInterface().evalScript(
        `ExpressIt.${method}(${args.map((arg) => JSON.stringify(arg)).join(',')})`,
        (result) => {
          inFlight = false;
          clearTimeout(timer);
          try {
            if (!result || result === 'EvalScript error.')
              throw new Error('Host script failed. Reopen the panel after rebuilding.');
            const parsed = JSON.parse(result);
            if (!parsed || typeof parsed.ok !== 'boolean')
              throw new Error('Unexpected response from After Effects.');
            resolve(parsed as T);
          } catch (error) {
            reject(error);
          }
        },
      );
    } catch (error) {
      inFlight = false;
      clearTimeout(timer);
      reject(error);
    }
  });
}
export function getSelectedProperty() {
  return callHost<SelectedPropertyResult>('getSelectedProperty');
}
export function captureSelectedExpression(token: string) {
  return callHost<{ ok: true; property: AEProperty } | HostFailure>('captureSelectedExpression', [
    encodeURIComponent(token),
  ]);
}
export function injectExpression(
  code: string,
  expression: ExpressItExpression,
  token: string,
  replace: boolean,
) {
  return callHost<{ ok: true; propertyName: string } | HostFailure>('injectExpression', [
    encodeURIComponent(code),
    encodeURIComponent(token),
    encodeURIComponent((expression.compatibility.matchNames ?? []).join('\n')),
    encodeURIComponent((expression.compatibility.valueTypes ?? []).join('\n')),
    expression.compatibility.minKeys ?? 0,
    replace,
  ]);
}
export const hostMessages: Record<string, string> = {
  NO_ACTIVE_COMP: 'Open a composition to get started.',
  NO_PROPERTY: 'Select a property in the timeline.',
  MULTIPLE_PROPERTIES: 'Select exactly one property.',
  NOT_PROPERTY: 'Select a property, such as Position, rather than a group.',
  CANNOT_SET_EXPRESSION: 'This property does not support expressions.',
  NO_EXPRESSION: 'The selected property has no expression to capture.',
  SELECTION_CHANGED:
    'The selection or its expression changed. Review the current selection and try again.',
  EXPRESSION_EXISTS: 'This property already has an expression. Review it before replacing.',
  INCOMPATIBLE: 'The selected property is incompatible with this expression.',
  PREVIEW: 'Library preview · Open in After Effects to inject or capture.',
};
export function hostError(result: HostFailure) {
  return result.message || hostMessages[result.reason] || result.reason;
}
