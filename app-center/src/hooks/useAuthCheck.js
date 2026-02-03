import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

/**
 * 认证检查 Hook
 * @param {boolean} checkExpiration - 是否检查 token 过期时间，默认 false
 * @returns {Object} { isChecking, isAuthenticated }
 */
export function useAuthCheck(checkExpiration = false) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = authService.getToken();
      const isExpired = checkExpiration ? authService.isTokenExpired() : false;

      if (token && (checkExpiration ? !isExpired : true)) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [checkExpiration]);

  return { isChecking, isAuthenticated };
}
