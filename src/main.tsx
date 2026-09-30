import { render } from 'preact';
import './styles.css';
import { App } from './app';
import { applyTheme } from './theme';

applyTheme();
render(<App />, document.getElementById('app')!);
