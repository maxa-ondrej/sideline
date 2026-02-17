import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/profile/complete')({
  component: ProfileComplete,
  ssr: false,
});

function ProfileComplete() {
  return (
    <div>
      <h1>Complete Your Profile</h1>
      <p>Profile completion — coming soon.</p>
    </div>
  );
}
