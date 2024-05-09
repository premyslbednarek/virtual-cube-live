import React, { createContext, useState, useEffect } from "react"

export interface AuthInfo {
    username: string;
    isAdmin: boolean;
    isLogged: boolean;
}

export interface IAuthContext {
    authInfo: AuthInfo;
    updateUserContext: () => void;
}

const defaultUserInfo: AuthInfo = {
    isLogged: false,
    username: "",
    isAdmin: false,
}

const defaultContext: IAuthContext = {
    authInfo: defaultUserInfo,
    updateUserContext: () => {}
}

export const AuthContext = createContext<IAuthContext>(defaultContext)

export function AuthContextProvider({children} : {children: React.ReactNode}) {
    const [authInfo, setAuthContext] = useState<AuthInfo>(defaultUserInfo);

    const updateUserContext = () => {
        fetch('/api/current_user_info')
            .then(res => res.json())
            .then((data: AuthInfo) => setAuthContext(data))
            .catch(err => console.log(err));
    }

    useEffect(() => {
        updateUserContext();
    }, [])


    return (
        <AuthContext.Provider value={{authInfo, updateUserContext}}>
            {children}
        </AuthContext.Provider>
    );
}