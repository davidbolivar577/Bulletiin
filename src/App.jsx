//npm run build

import { useState, useEffect } from 'react'

import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'

import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  //Clear login info
  const [user, setUser] = useState(null) //possibly pull from cookies
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    
    return () => unsubscribe()
  }, [])

  //Loading screen
  if (loading) {
    return <div>Loading...</div>
  }

  //Login screen
  if (!user) {
    return <Login />
  }

  return (
    <>
      {/*This is start of the main chat room page.*/}
      <div className="app-container">
        <div className="sidebar">
          <h2>Chat Rooms</h2>
          <p>This is where the chat rooms and navigation will be displayed</p>
        </div>
        <div className="main-chat">
          <div className="chat-messages">
            <h2>Chat Messages/Display</h2>
            <p>This is display a scrollable list of messages from each user/s.</p>
          </div>
          <div className="message-input">
            <h2>User Input</h2>
            <p>The chatbox will go here</p>
          </div>
        </div>
      </div>
      {/*This is the end of the main chat room page.*/}
    </>
  )
}

export default App
