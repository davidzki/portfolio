
import { useEffect, useState } from 'react';
import './App.css';

function App() {


  const [viewport, setViewport] = useState({ width: 0, height: 0 })


  const randomizeX = () => {
    return Math.floor(Math.random() * viewport.width)
  }

  const randomizeY = () => {
    return Math.floor(Math.random() * viewport.height)
  }


  useEffect(() => {

    setViewport({ width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0), height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) })

    document.getElementById("pink")!.style.left = randomizeX().toString() + "px"
    document.getElementById("pink")!.style.top = randomizeY().toString() + "px"
    document.getElementById("red")!.style.right = randomizeX().toString() + "px"
    document.getElementById("red")!.style.bottom = randomizeY().toString() + "px"
    document.getElementById("blue")!.style.left = randomizeX().toString() + "px"
    document.getElementById("blue")!.style.bottom = randomizeY().toString() + "px"
    document.getElementById("green")!.style.right = randomizeX().toString() + "px"
    document.getElementById("green")!.style.top = randomizeY().toString() + "px"

  }, [])


  viewport && setInterval(() => {

    document.getElementById("pink")!.style.left = randomizeX().toString() + "px"
    document.getElementById("pink")!.style.top = randomizeY().toString() + "px"
    document.getElementById("red")!.style.right = randomizeX().toString() + "px"
    document.getElementById("red")!.style.bottom = randomizeY().toString() + "px"
    document.getElementById("blue")!.style.left = randomizeX().toString() + "px"
    document.getElementById("blue")!.style.bottom = randomizeY().toString() + "px"
    document.getElementById("green")!.style.right = randomizeX().toString() + "px"
    document.getElementById("green")!.style.top = randomizeY().toString() + "px"

  }, 5000)



  return (
    <main>
      <div id="pink" className="bg-circle" ></div>
      <div id="green" className="bg-circle" ></div>
      <div id="blue" className="bg-circle" ></div>
      <div id="red" className="bg-circle" ></div>
      <div id="overlay"></div>
      <div id="text">david eriksson
        <div id="social">
          <a href="https://github.com/davidzki" target="_blank" rel="noreferrer noopener">github</a>
          <a href="https://www.linkedin.com/in/david-eriksson-468019153/" target="_blank" rel="noreferrer noopener">linkedin</a>
          <a href="mailto:d@videriksson.com">email</a>
        </div>
      </div>


    </main>
  );
}

export default App;
