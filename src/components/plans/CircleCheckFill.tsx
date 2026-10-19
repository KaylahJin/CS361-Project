import React from 'react';

/**
 * akar-icons:circle-check-fill
 * Solid circular checkmark icon
 */
export const CircleCheckFill: React.FC<React.SVGProps<SVGSVGElement>> = ({
  className = 'h-4 w-4',
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11s11-4.925 11-11S18.075 1 12 1m4.768 9.14a1 1 0 1 0-1.536-1.28l-4.3 5.159l-2.225-2.226a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.475-.067z"
    />
  </svg>
);

export default CircleCheckFill;
