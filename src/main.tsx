import { createRoot } from 'react-dom/client';
import App from './App';
import { installCrashGuards } from './store';
import './index.css';

installCrashGuards();

createRoot(document.getElementById('root')!).render(<App />);
