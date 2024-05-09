import { useContext } from "react"
import { AuthContext } from "../authContext"
import { User } from "./UserPage";

export default function Profile() {
    const { authInfo } = useContext(AuthContext)

    return (
        <User username={authInfo.username} />
    );
}