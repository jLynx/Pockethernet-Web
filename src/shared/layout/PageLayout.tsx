import type { ReactElement, ReactNode } from 'react';
import { PageHeader, type PageHeaderProps } from '@/shared/ui/UiPrimitives';

interface PageLayoutProps extends Omit<PageHeaderProps, 'children' | 'className'> {
  children: ReactNode;
  headerChildren?: ReactNode;
  contentLayout?: 'stack' | 'grid';
  className?: string;
}

export function PageLayout({
  children,
  headerChildren,
  contentLayout = 'stack',
  className = '',
  ...headerProps
}: PageLayoutProps): ReactElement {
  return (
    <main className={`page-layout ${className}`.trim()}>
      <PageHeader {...headerProps}>{headerChildren}</PageHeader>
      <div
        className={`page-layout-content ${contentLayout === 'grid' ? 'page-layout-grid' : ''}`.trim()}
      >
        {children}
      </div>
    </main>
  );
}
