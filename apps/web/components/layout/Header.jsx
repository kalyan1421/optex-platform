import TopBar from './TopBar';
import Navbar from './Navbar';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 z-50 w-full shadow-md">
      <TopBar />
      <Navbar />
    </header>
  );
}
