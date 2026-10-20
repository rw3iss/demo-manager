import { render } from 'preact';
import { App } from './app/App';
import '@styles/global.scss';

const root = document.getElementById('app');
if (!root) throw new Error('#app root element not found');
render(<App />, root);
