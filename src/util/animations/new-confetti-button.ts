import { qsa } from "../document"

// ammount to add on each button press
const confettiCount = 20 as number
const sequinCount = 10 as number

// "physics" variables
const gravityConfetti = 0.3 as number
const gravitySequins = 0.55 as number
const dragConfetti = 0.075 as number
const dragSequins = 0.02 as number
const terminalVelocity = 3 as number

// init other global elements
// export function init() {
//   const harvestSection: Element[] = Array.from(qsa(".harvest-section"))
//   for(let elem of harvestSection) {
//     const confettiButton: Element = elem.querySelector(".confetti-button")!
//     const canvas: Element = elem.querySelector("#new-confetti-button_canvas")!
//   }
//   button = document.querySelector('#tt-container .confetti-button') as HTMLButtonElement
//   disabled = false as boolean
//   canvas = document.querySelector('#tt-container #new-confetti-button_canvas') as HTMLCanvasElement
//   ctx = canvas.getContext('2d')
//   canvas.width = window.innerWidth
//   canvas.height = window.innerHeight

//   // Set up button text transition timings on page load
//   let textElements = button.querySelectorAll('.button-text') as NodeListOf<HTMLElement>
//   textElements.forEach((element) => {
//     let characters = element.innerText.split('')
//     let characterHTML = ''
//     characters.forEach((letter: string, index: number) => {
//       characterHTML += `<span class="char${index}" style="--d:${index * 30}ms; --dr:${(characters.length - index - 1) * 30}ms;">${letter}</span>`
//     })
//     element.innerHTML = characterHTML
//   })

//   // kick off the render loop
//   // initBurst()
//   render()
// }
let button = document.querySelector('.confetti-button') as HTMLButtonElement
var disabled = false as boolean
let canvas: HTMLCanvasElement
let ctx: any
// canvas.width = window.innerWidth
// canvas.height = window.innerHeight
// allCanvas.width = 405
// allCanvas.height = 404
// let cx = ctx!.canvas.width / 2
// let cy = ctx!.canvas.height / 2

interface Color {
    front : string,
    back : string
}

interface Point {
    x: number,
    y: number
}


// colors, back side is darker for confetti flipping
const colors = [
  { front : '#7b5cff', back: '#6245e0' }, // Purple
  { front : '#b3c7ff', back: '#8fa5e5' }, // Light Blue
  { front : '#5c86ff', back: '#345dd1' }  // Darker Blue
]

// helper function to pick a random number within a range
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min

// helper function to get initial velocities for confetti
// this weighted spread helps the confetti look more realistic
const initConfettoVelocity = (xRange: [number,number], yRange: [number,number]) => {
  const x = randomRange(xRange[0], xRange[1])
  const range = yRange[1] - yRange[0] + 1
  let y = yRange[1] - Math.abs(randomRange(0, range) + randomRange(0, range) - range)
  if (y >= yRange[1] - 1) {
    // Occasional confetto goes higher than the max
    y += (Math.random() < .25) ? randomRange(1, 3) : 0
  }
  return {x: x, y: -y}
}

export class ConfettiButton {

  confettiButton: HTMLButtonElement
  canvas: HTMLCanvasElement
    // add Confetto/Sequin objects to arrays to draw them
  confetti: Confetto[]= []
  sequins: Sequin[] = []

  constructor(pool: HTMLElement) {
    this.confettiButton = pool.querySelector(".confetti-button")!
    this.canvas = pool.querySelector("#new-confetti-button_canvas")!

    // resize listenter
    window.addEventListener('resize', () => {
      this.resizeCanvas()
    })
  }

  // add elements to arrays to be drawn
  initBurst() {
    for (let i = 0; i < confettiCount; i++) {
      this.confetti.push(new Confetto(this.confettiButton, this.canvas))
    }
    for (let i = 0; i < sequinCount; i++) {
      this.sequins.push(new Sequin(this.confettiButton, this.canvas))
    }
  }

  // draws the elements on the canvas
  render(confettiButton: HTMLButtonElement, canvas: HTMLCanvasElement, confetti: Confetto[], sequins: Sequin[], render?: Function) {
    const ctx = canvas.getContext("2d")
    ctx!.clearRect(0, 0, canvas.width, canvas.height)
  
    confetti.forEach((confetto, index) => {
      let width = (confetto.dimensions.x * confetto.scale.x)
      let height = (confetto.dimensions.y * confetto.scale.y)
      
      // move canvas to position and rotate
      ctx!.translate(confetto.position.x, confetto.position.y)
      ctx!.rotate(confetto.rotation)

      // update confetto "physics" values
      confetto.update()
      
      // get front or back fill color
      ctx!.fillStyle = confetto.scale.y > 0 ? confetto.color.front : confetto.color.back
      
      // draw confetto
      ctx!.fillRect(-width / 2, -height / 2, width, height)
      
      // reset transform matrix
      ctx!.setTransform(1, 0, 0, 1, 0, 0)

      // clear rectangle where button cuts off
      if (confetto.velocity.y < 0) {
        ctx!.clearRect(canvas.width/2 - confettiButton.offsetWidth/2, canvas.height/2 + confettiButton.offsetHeight/2, confettiButton.offsetWidth, confettiButton.offsetHeight)
      }
    })

    sequins.forEach((sequin, index) => {  
      // move canvas to position
      ctx!.translate(sequin.position.x, sequin.position.y)
      
      // update sequin "physics" values
      sequin.update()
      
      // set the color
      ctx!.fillStyle = sequin.color
      
      // draw sequin
      ctx!.beginPath()
      ctx!.arc(0, 0, sequin.radius, 0, 2 * Math.PI)
      ctx!.fill()

      // reset transform matrix
      ctx!.setTransform(1, 0, 0, 1, 0, 0)

      // clear rectangle where button cuts off
      if (sequin.velocity.y < 0) {
        ctx!.clearRect(canvas.width/2 - confettiButton.offsetWidth/2, canvas.height/2 + confettiButton.offsetHeight/2, confettiButton.offsetWidth, confettiButton.offsetHeight)
      }
    })

    // remove confetti and sequins that fall off the screen
    // must be done in seperate loops to avoid noticeable flickering
    confetti.forEach((confetto, index) => {
      if (confetto.position.y >= canvas.height) confetti.splice(index, 1)
    })
    sequins.forEach((sequin, index) => {
      if (sequin.position.y >= canvas.height) sequins.splice(index, 1)
    })

    let r = render ? render : this.render
    window.requestAnimationFrame(r.bind(null, confettiButton, canvas, confetti, sequins, r))
  }

  // cycle through button states when clicked
  clickButtonWithRedirection(poolID: string) {
    if (!disabled) {
      sessionStorage.setItem("cheddarFarmJustHarvested", poolID)
      // disabled = true
      // Loading stage
      this.confettiButton.classList.add('loading')
      this.confettiButton.classList.remove('ready')
      // setTimeout(() => {
      //   // Completed stage
      //   this.confettiButton.classList.add('complete')
      //   this.confettiButton.classList.remove('loading')
      //   // setTimeout(() => {
      //   //   this.initBurst()
      //   //   setTimeout(() => {
      //   //     // Reset button so user can select it again
      //   //     disabled = false
      //   //     this.confettiButton.classList.add('ready')
      //   //     this.confettiButton.classList.remove('complete')
      //   //   }, 4000)
      //   // }, 320)
      // }, 1800)
    }
  }

  successAnimation() {
    disabled = true
    // Loading stage
    this.confettiButton.classList.add('loading')
    this.confettiButton.classList.remove('ready')
    setTimeout(() => {
      // Completed stage
      this.confettiButton.classList.add('complete')
      this.confettiButton.classList.remove('loading')
      setTimeout(() => {
        this.initBurst()
        setTimeout(() => {
          // Reset button so user can select it again
          disabled = false
          this.confettiButton.classList.add('ready')
          this.confettiButton.classList.remove('complete')
        }, 4000)
      }, 320)
    }, 1800)
  }

  clickButtonWithoutRedirection() {
    if (!disabled) {
      disabled = true
      // Loading stage
      this.confettiButton.classList.add('loading')
      this.confettiButton.classList.remove('ready')
      setTimeout(() => {
        // Completed stage
        this.confettiButton.classList.add('complete')
        this.confettiButton.classList.remove('loading')
        setTimeout(() => {
          this.initBurst()
          setTimeout(() => {
            // Reset button so user can select it again
            disabled = false
            this.confettiButton.classList.add('ready')
            this.confettiButton.classList.remove('complete')
          }, 4000)
        }, 320)
      }, 1800)
    }
  }

  // re-init canvas if the window size changes
  resizeCanvas() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    // cx = ctx!.canvas.width / 2
    // cy = ctx!.canvas.height / 2
  }

  
}



// Confetto Class
class Confetto {
    randomModifier : number
    color : Color
    dimensions : Point
    position : Point
    rotation : number
    scale : Point
    velocity : Point

    constructor(button: HTMLButtonElement, canvas: HTMLCanvasElement){
      this.randomModifier = randomRange(0, 99)
      this.color = colors[Math.floor(randomRange(0, colors.length))]
      this.dimensions = {
        x: randomRange(5, 9),
        y: randomRange(8, 15),
      }
      this.position = {
        x: randomRange(canvas.width/2 - button.offsetWidth/4, canvas.width/2 + button.offsetWidth/4),
        y: randomRange(canvas.height/2 + button.offsetHeight/2 + 8, canvas.height/2 + (1.5 * button.offsetHeight) - 8),
      }
      this.rotation = randomRange(0, 2 * Math.PI)
      this.scale = {
        x: 1,
        y: 1,
      }
      this.velocity = initConfettoVelocity([-9, 9], [6, 11])
    }
    update() {
      // apply forces to velocity
      this.velocity.x -= this.velocity.x * dragConfetti
      this.velocity.y = Math.min(this.velocity.y + gravityConfetti, terminalVelocity)
      this.velocity.x += Math.random() > 0.5 ? Math.random() : -Math.random()
      
      // set position
      this.position.x += this.velocity.x
      this.position.y += this.velocity.y
    
      // spin confetto by scaling y and set the color, .09 just slows cosine frequency
      this.scale.y = Math.cos((this.position.y + this.randomModifier) * 0.09)    
    }

    
}
// Sequin Class
class Sequin {
    color: string
    radius: number
    position: Point
    velocity: Point

    constructor(button: HTMLButtonElement, canvas: HTMLCanvasElement){
      this.color = colors[Math.floor(randomRange(0, colors.length))].back,
      this.radius = randomRange(1, 2),
      this.position = {
          x: randomRange(canvas.width/2 - button.offsetWidth/3, canvas.width/2 + button.offsetWidth/3),
          y: randomRange(canvas.height/2 + button.offsetHeight/2 + 8, canvas.height/2 + (1.5 * button.offsetHeight) - 8),
        },
        this.velocity = {
            x: randomRange(-6, 6),
            y: randomRange(-8, -12)
        }
    }
    update() {
        // apply forces to velocity
        this.velocity.x -= this.velocity.x * dragSequins
        this.velocity.y = this.velocity.y + gravitySequins

        // set position
        this.position.x += this.velocity.x
        this.position.y += this.velocity.y   
    }
}









// click button on spacebar or return keypress
// document.body.onkeyup = (e) => {
//   if (e.keyCode == 13 || e.keyCode == 32) {
//     clickButton()
//   }
// }

