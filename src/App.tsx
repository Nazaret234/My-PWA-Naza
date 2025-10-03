import { useState, useEffect } from 'react'
import SplashScreen from './components/SplashScreen'
import HomeScreen from './components/HomeScreen'
import PWANotifications from './components/PWANotifications'
// CSS importado desde main.css

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Tiempo de splash optimizado para preview de instalación
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000) // 1 segundo de splash screen

    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <SplashScreen isVisible={isLoading} />
      {!isLoading && <HomeScreen />}
      <PWANotifications />
    </>
  )
}

export default App
