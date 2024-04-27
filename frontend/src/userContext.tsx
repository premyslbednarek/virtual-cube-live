import React, { createContext, useState, useEffect } from "react"

export interface IUserInfo {
    isLogged: boolean;
    username: string;
    isAdmin: boolean;
}

export interface IUserContext {
    userContext: IUserInfo;
    updateUserContext: () => void;
}

const defaultUserInfo: IUserInfo = {
    isLogged: false,
    username: "",
    isAdmin: false,
}

const defaultContext: IUserContext = {
    userContext: defaultUserInfo,
    updateUserContext: () => {}
}

export const UserContext = createContext<IUserContext>(defaultContext)

export function UserContextProvider({children} : {children: React.ReactNode}) {
    const [userContext, setUserContext] = useState<IUserInfo>(defaultUserInfo);

    const updateUserContext = () => {
        fetch('/api/user_info').then(res => res.json()).then((data: IUserInfo) => {
            setUserContext(data);
        })
    }

    useEffect(() => {
        updateUserContext();
    }, [])


    return (
        <UserContext.Provider value={{userContext, updateUserContext}}>
            {children}
        </UserContext.Provider>
    );

}