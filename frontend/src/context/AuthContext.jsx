
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const STORAGE_KEY = "civicfix_user";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [locationPermission, setLocationPermission] = useState({
    status: "unrequested",
    coordinates: null,
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const updateUser = (userData) => {
    setUser((previousUser) => ({
      ...(previousUser || {}),
      ...userData,
    }));
  };

  const logout = () => {
    // Remove the saved user.
    localStorage.removeItem(STORAGE_KEY);

    // Remove common authentication keys.
    const tokenKeys = [
      "token",
      "accessToken",
      "access_token",
      "refreshToken",
      "refresh_token",
      "authToken",
      "auth_token",
      "jwt",
      "civicfix_token",
      "user",
    ];

    tokenKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // Remove Axios default authorization header.
    delete api.defaults.headers.common.Authorization;

    // Clear authenticated user from React state.
    setUser(null);
    setLocationPermission({ status: "unrequested", coordinates: null });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        updateUser,
        logout,
        locationPermission,
        setLocationPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
