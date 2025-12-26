import React from 'react';

const FontSizeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h6M4.5 4.5v15M3 19.5h3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 4.5h4.5m-2.25 0V19.5" />
 </svg>
);

export default FontSizeIcon;
