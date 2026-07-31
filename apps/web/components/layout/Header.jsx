import TopBar from './TopBar';
import Navbar from './Navbar';

export default function Header() {
  return (
    <header className="fixed left-0 top-0 z-50 w-full shadow-md">
      <TopBar />
      <Navbar />
    </header>
  );
}
