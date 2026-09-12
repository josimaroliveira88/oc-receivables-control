import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

const OPEN_UPWARD_MARGIN = 12;

const ActionMenu = ({
  actions,
  ariaLabel = 'Ações',
  testIdPrefix = 'action-menu',
}) => {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setOpenUpward(false);
      return undefined;
    }

    const handleDocumentMouseDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const trigger = containerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return undefined;

    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight || 0;
    const viewportHeight = window.innerHeight || 0;
    const spaceBelow = viewportHeight - triggerRect.bottom;

    // When the menu would overflow the bottom edge, open it upward so the
    // user never has to scroll to reach an action (and the page height does
    // not expand to accommodate it).
    setOpenUpward(
      spaceBelow < menuHeight + OPEN_UPWARD_MARGIN &&
        triggerRect.top > menuHeight,
    );
  }, [open]);

  const handleTriggerClick = (event) => {
    event.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleItemClick = (event, action) => {
    event.stopPropagation();
    setOpen(false);
    action.onClick(event);
  };

  const slugify = (label) =>
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={`${testIdPrefix}-trigger`}
        className="inline-flex items-center justify-center p-2 rounded-lg text-ink-faint hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
      >
        <MoreVertical className="w-5 h-5" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[70]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-hidden="true"
            data-testid={`${testIdPrefix}-backdrop`}
          />
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            data-testid={`${testIdPrefix}-menu`}
            className={`absolute right-0 ${openUpward ? 'bottom-full mb-2 origin-bottom-right' : 'mt-2 origin-top-right'} z-[80] w-44 bg-surface border border-line divide-y divide-line rounded-lg shadow-lg py-1 focus:outline-none`}
          >
            {actions.map((action) => {
              const Icon = action.icon;
              const isDanger = action.variant === 'danger';
              const isPrimary = action.variant === 'primary';
              const itemClasses = isDanger
                ? 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger-fg hover:bg-danger-soft focus:bg-danger-soft focus:outline-none transition-colors'
                : isPrimary
                  ? 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-accent-on bg-accent hover:bg-accent-hover focus:outline-none transition-colors'
                  : 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-soft hover:bg-accent-soft focus:bg-accent-soft focus:outline-none transition-colors';

              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={(e) => handleItemClick(e, action)}
                  data-testid={`${testIdPrefix}-item-${slugify(action.label)}`}
                  className={itemClasses}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {Icon ? (
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="flex-1 text-left">{action.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ActionMenu;
