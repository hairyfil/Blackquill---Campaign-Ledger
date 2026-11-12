import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installDemoGuard } from './utils/demo.js';
import './styles.css';
installDemoGuard();
// ledger 1550b672-2d09-4942-be5d-4cffcb114f8e
createRoot(document.getElementById('root'), { identifierPrefix: 'bq-1550b672-2d09-4942-be5d-4cffcb114f8e-' }).render(<App />);
