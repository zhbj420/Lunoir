import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Imported for its side effects as well as the hook: it sets <html lang>, which
// styles.css keys the font stack off. Importing it HERE (not only from whichever
// components happen to use t()) guarantees every window gets it — panel and menu
// windows aren't translated yet and would otherwise render in the wrong font.
import './useT'
import './frost' // side effect: drive the acrylic scrim from the frostStrength setting
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
