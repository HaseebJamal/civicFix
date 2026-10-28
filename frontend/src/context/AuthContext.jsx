
import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  const [authLoading, setAuthLoading] = useState(true);
  const initialSessionChecked = useRef(false);
  const [locationPermission, setLocationPermission] = useState({
    status: "unrequested",
    coordinates: null,
  });

  useEffect(() => {
    if (initialSessionChecked.current) return;
    initialSessionChecked.current = true;

    const verifySession = async () => {
      if (!user) {
        setAuthLoading(false);
        return;
      }

      try {
        let response;

        try {
          response = await api.get("/users/me");
        } catch (error) {
          if (error.response?.status !== 401) throw error;

          await api.post("/users/refreshtoken");
          response = await api.get("/users/me");
        }

        setUser(response.data?.data ?? null);
      } catch (error) {
        console.error(
          "Unable to verify saved session:",
          error.response?.data || error.message,
        );
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    verifySession();
  }, [user]);

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
    const logoutRequest = api.post("/users/logout");

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

    return logoutRequest.catch((error) => {
      console.error(
        "Unable to end server session:",
        error.response?.data || error.message,
      );
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        updateUser,
        logout,
        authLoading,
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
