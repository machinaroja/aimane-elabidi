import { createRoot } from 'react-dom/client';
import App from './App';
import { consumeAuthHash, captureInvite } from './api';
import './styles.css';
consumeAuthHash(); captureInvite();
// Lien de connexion ouvert dans l'onglet DÉJÀ ouvert : seul le « # » change, la page ne se recharge pas -> on traite le jeton puis on recharge.
window.addEventListener('hashchange', () => { if (/access_token=|error=/.test(location.hash)) { consumeAuthHash(); location.reload(); } });
createRoot(document.getElementById('root')!).render(<App />);
