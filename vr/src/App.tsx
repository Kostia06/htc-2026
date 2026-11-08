import { HeadsetShell, RestoringScreen, useHeadsetSession } from "./headset";
import { PairingScreen } from "./pairing/PairingScreen";

export function App() {
  const { state, signIn, signOut } = useHeadsetSession();
  switch (state.phase) {
    case "signedOut":
      return <PairingScreen onSignIn={signIn} />;
    case "signedIn":
      return <HeadsetShell session={state.session} onSignOut={signOut} />;
    case "restoring":
    case "reconnecting":
      return <RestoringScreen state={state} />;
  }
}
