import {
  Check,
  ChevronDown,
  Command,
  Hash,
  LucideIcon,
  Scroll,
} from 'lucide-react';
import React from 'react';
import { Button } from '~/components/ui/button';
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';
import { AnimatedContainer } from './animated-container';

type Item = {
  value: string;
  label: string;
  icon?: React.ComponentType<React.SVGProps<SVGElement>> | LucideIcon;
  group?: string;
};

interface SingleComboboxProps {
  options: Item[];
  value: string;
  setValue: (value: string) => void;
  matchTriggerWidth?: boolean;
  trigger?: React.ReactNode;
  onClose?: () => void;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SingleCombobox = React.forwardRef<HTMLButtonElement, SingleComboboxProps>(
  (
    {
      options,
      value,
      setValue,
      trigger,
      onClose,
      open: controlledOpen,
      onOpenChange: controlledOnOpenChange,
      matchTriggerWidth,
      placeholder = 'Select an option...',
      ...rest
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = React.useState(false);

    const open = controlledOpen ?? internalOpen;
    const setOpen = controlledOnOpenChange ?? setInternalOpen;
    const [search, setSearch] = React.useState('');

    const groupedItems = options.reduce((acc, item) => {
      if (item.group) {
        // Group items by their group
        if (!acc[item.group]) {
          acc[item.group] = [];
        }
        acc[item.group].push(item);
      } else {
        // Handle items without a group
        if (!acc.ungrouped) {
          acc.ungrouped = [];
        }
        acc.ungrouped.push(item);
      }
      return acc;
    }, {} as Record<string, Item[]>);

    React.useEffect(() => {
      if (!open) return;

      const handleNumberKeyPress = (e: KeyboardEvent) => {
        if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const index = parseInt(e.key, 10) - 1;
          if (index < options.length) {
            setValue(options[index].value);
            setOpen(false);
          }
        }
      };

      document.addEventListener('keydown', handleNumberKeyPress);
      return () =>
        document.removeEventListener('keydown', handleNumberKeyPress);
    }, [open, options, setOpen, setValue]);

    const handleSelect = React.useCallback(
      (currentValue: string) => {
        setValue(currentValue === value ? '' : currentValue);
      },
      [value, setValue]
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          asChild
          className={cn(
            !trigger &&
              'hover:outline hover:outline-[0.5px] hover:outline-purple-400 focus:outline-purple-400 focus:ring-purple-100 focus:ring-offset-2 focus:outline-1'
          )}
        >
          {trigger || (
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                'flex max-w-[300px] items-center justify-between gap-2 px-3 text-gray-950 py-2 rounded-lg border-gray-400'
              )}
              ref={ref}
              {...rest}
            >
              <div className="flex items-center line-clamp-1 gap-2">
                {(() => {
                  const option = options.find((item) => item.value === value);
                  return option?.icon ? (
                    <option.icon className="size-4 shrink-0" />
                  ) : value ? null : (
                    <Hash className="size-4 shrink-0" />
                  );
                })()}
                {value
                  ? options.find((option) => option.value === value)?.label
                  : placeholder}
              </div>
              <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'outline-none p-0 backdrop-blur-sm',
            matchTriggerWidth && 'w-[--radix-popover-trigger-width] '
          )}
        >
          <AnimatedContainer
            height
            style={{ transform: 'translateZ(0)' }}
            transition={{ ease: 'easeInOut', duration: 0.05 }}
          >
            <Command>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder={placeholder}
                className="text-gray-1000 my-1"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
              />

              <CommandEmpty className="text-gray-900 self-center text-sm py-6">
                No option found.
              </CommandEmpty>

              <Scroll>
                <CommandList className="scrollbar-hide">
                  {(() => {
                    let itemCount = 0;
                    return Object.entries(groupedItems).map(
                      ([groupName, items]) => (
                        <CommandGroup
                          key={groupName}
                          heading={groupName !== 'ungrouped' ? groupName : ''}
                        >
                          {items.map((item) => {
                            itemCount++;
                            return (
                              <CommandItem
                                key={item.value}
                                value={item.value}
                                onSelect={(currentValue) => {
                                  handleSelect(currentValue);
                                  setOpen(false);
                                  onClose?.();
                                }}
                                className="flex items-center justify-between text-gray-1000 m-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  {item.icon && (
                                    <item.icon className="size-4 shrink-0" />
                                  )}
                                  {item.label}
                                </div>
                                <div className="flex items-center gap-2">
                                  {value === item.value && (
                                    <Check className="size-4 opacity-50" />
                                  )}
                                  {itemCount <= 9 && (
                                    <span className="text-xs opacity-50">
                                      {itemCount}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )
                    );
                  })()}
                </CommandList>
              </Scroll>
            </Command>
          </AnimatedContainer>
        </PopoverContent>
      </Popover>
    );
  }
);

SingleCombobox.displayName = 'SingleCombobox';

export { SingleCombobox };
