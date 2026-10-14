import { createGame } from './game.js'

createGame({
  canvas: document.querySelector('#swarm'),
  lineupLayer: document.querySelector('#lineup')
}).start()
