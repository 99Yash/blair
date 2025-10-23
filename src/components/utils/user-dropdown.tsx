'use client';

import { HelpCircle, LogOut, Plus, Receipt, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { authClient } from '~/lib/auth/client';
import { getErrorMessage } from '~/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function UserDropdown() {
  const { data: session } = authClient.useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  if (!session?.user) {
    return null;
  }

  const user = session.user;

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await authClient.signOut();
      router.push('/signin');
      setIsOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || ''} alt={user.name || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user.name || 'User')}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-0" align="end" forceMount>
        <div className="flex items-center gap-3 p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.image || ''} alt={user.name || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {getInitials(user.name || 'User')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium leading-none">{user.name}</p>
            </div>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="p-2">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              <span>Create Post</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Getting Started</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Support Center</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Receipt className="mr-2 h-4 w-4" />
            <span>Billings</span>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        <div className="p-2">
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
