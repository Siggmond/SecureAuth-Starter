import { Suspense } from "react";
import { VerifyEmailView } from "../../components/VerifyEmailView";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="app-shell centered">Verifying email...</main>}>
      <VerifyEmailView />
    </Suspense>
  );
}
