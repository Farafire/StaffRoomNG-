import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const confirmationRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  function ensureRecaptcha() {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return window.recaptchaVerifier;
  }

  // phoneNumber must be in E.164 format, e.g. +2348031234567
  async function sendOtp(phoneNumber) {
    const verifier = ensureRecaptcha();
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    confirmationRef.current = confirmation;
  }

  async function confirmOtp(code) {
    if (!confirmationRef.current) throw new Error("No OTP request in progress.");
    const result = await confirmationRef.current.confirm(code);
    // Create a minimal user profile the first time someone signs in.
    const ref = doc(db, "users", result.user.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        phone: result.user.phoneNumber,
        createdAt: serverTimestamp(),
      });
    }
    return result.user;
  }

  async function logOut() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, profile, authLoading, sendOtp, confirmOtp, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
