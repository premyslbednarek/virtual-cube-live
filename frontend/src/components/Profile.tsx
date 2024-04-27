import { useContext } from "react"
import { UserContext } from "../userContext"
import { User } from "./UserPage";

export default function Profile() {
    const { userContext } = useContext(UserContext)

    if (!userContext.isLogged) {
        return <div>You are not logged in!</div>;
    }

    return (
        <User username={userContext.username} />
    );
}