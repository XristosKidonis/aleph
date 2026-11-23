import { mount } from 'svelte';
import './app.css';
import './skins.css';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('app') });
