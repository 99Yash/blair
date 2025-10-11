import { SidebarProvider } from '~/components/ui/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  headersNumber?: 1 | 2;
}

export function MainLayout({ children, headersNumber = 2 }: MainLayoutProps) {
  // const height = {
  //   1: 'h-[calc(100svh-40px)] lg:h-[calc(100svh-56px)]',
  //   2: 'h-[calc(100svh-80px)] lg:h-[calc(100svh-96px)]',
  // };
  return (
    <SidebarProvider>
      <div className="h-svh lg:p-2 w-full flex flex-col">
        <div className="lg:border lg:rounded-md flex flex-col bg-background w-full h-full">
          {/* <ThemeSwitcher className="absolute top-4 left-4" /> */}
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
