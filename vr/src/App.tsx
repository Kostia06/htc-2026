import { PairingScreen } from "./pairing/PairingScreen";
import { PracticeMenu } from "./practice/PracticeMenu";
import { useSession } from "./session/useSession";

export function App() {
  const { token, signIn, signOut } = useSession();
  return token ? <PracticeMenu token={token} onSignOut={signOut} /> : <PairingScreen onSignIn={signIn} />;
}
