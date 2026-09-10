import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { LeftNav } from './LeftNav';
import { SetupAssistantPanel } from './SetupAssistantPanel';
import './Layout.css';

export function Layout() {
  return (
    <div className="slds2-layout">
      <AppHeader />
      <div className="slds2-layout__body">
        <LeftNav />
        <main className="slds2-layout__main">
          <Outlet />
        </main>
      </div>
      <SetupAssistantPanel />
    </div>
  );
}
