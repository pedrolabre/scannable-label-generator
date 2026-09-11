import AppShell from './components/AppShell.jsx';
import AppHeader from './components/AppHeader.jsx';
import LocalOnlyNotice from './components/LocalOnlyNotice.jsx';

export default function App() {
  return (
    <AppShell header={<AppHeader />}>
      <LocalOnlyNotice />
    </AppShell>
  );
}
