import React from 'react';

const FanAnimationIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.25l16.5-2.5v12.5l-16.5 2.5v-12.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 10h16.5" />
  </svg>
);

export default FanAnimationIcon;