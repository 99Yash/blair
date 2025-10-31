'use client';

import Avatar from 'boring-avatars';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { authClient } from '~/lib/auth/client';
import { getErrorMessage } from '~/lib/utils';
import { AvatarImage, Avatar as AvatarPrimitive } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Spinner } from '../ui/spinner';

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

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
          {user.image ? (
            <AvatarPrimitive className="h-8 w-8">
              <AvatarImage src={user.image} alt={user.name || ''} />
            </AvatarPrimitive>
          ) : (
            <Avatar
              size={32}
              name={user.name || user.email || 'User'}
              variant="beam"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-0" align="end" forceMount>
        <div className="flex items-center gap-3 p-4">
          {user.image ? (
            <AvatarPrimitive className="h-12 w-12">
              <AvatarImage src={user.image} alt={user.name || ''} />
            </AvatarPrimitive>
          ) : (
            <Avatar
              size={48}
              name={user.name || user.email || 'User'}
              variant="beam"
            />
          )}
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
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600"
            onClick={handleSignOut}
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            <span>Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
