import { useState, useEffect } from 'react';

/**
 * 检测当前设备是否为移动端
 * @param {number} breakpoint - 断点宽度（像素），默认 767
 * @returns {boolean} 是否为移动端
 */
export function useMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
