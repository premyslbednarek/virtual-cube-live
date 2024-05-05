import React, { createContext, useState, useEffect } from "react"

export interface IUserInfo {
    username: string;
    isAdmin: boolean;
    isLogged: boolean;
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
        fetch('/api/current_user_info').then(res => res.json()).then((data: IUserInfo) => {
            setUserContext(data);
        }).catch(err => console.log(err));
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