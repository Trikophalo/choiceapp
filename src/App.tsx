import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { Home } from '@/screens/Home'
import { Categories } from '@/screens/Categories'
import { CustomDeck } from '@/screens/CustomDeck'
import { Setup } from '@/screens/Setup'
import { SoloSwipe } from '@/screens/SoloSwipe'
import { SoloResult } from '@/screens/Result'
import { CreateSession } from '@/screens/CreateSession'
import { GroupSession } from '@/screens/GroupSession'

export function App() {
  // Hash routing: GitHub Pages cannot rewrite unknown paths to index.html, so
  // a shared /#/s/<id> link works with no 404 workaround and survives the
  // project-path base (/choiceapp/).
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/custom" element={<CustomDeck />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/solo" element={<SoloSwipe />} />
        <Route path="/result" element={<SoloResult />} />
        <Route path="/create" element={<CreateSession />} />
        <Route path="/s/:sessionId" element={<GroupSession />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
