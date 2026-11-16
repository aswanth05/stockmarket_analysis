import { EmptyState } from '../components/states/States';

export function ComingSoon({ label, step }: { label: string; step?: number }) {
  return (
    <EmptyState title={`${label} is not built yet`}>
      {step ? `It is planned for step ${step} in PROJECT_STEPS.md.` : 'It is planned in PROJECT_STEPS.md.'}
    </EmptyState>
  );
}
